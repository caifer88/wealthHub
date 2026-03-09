from fastapi import HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from models import AssetMetricsResponse
from services import db_service

async def get_asset_metrics(asset_id: str, session: AsyncSession) -> AssetMetricsResponse:
    """Get metrics for a specific asset"""
    asset = await db_service.get_asset_by_id(session, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    history = await db_service.get_history_by_asset(session, asset_id)
    if not history:
        return AssetMetricsResponse(
            asset_id=asset_id,
            total_contributed=0.0,
            current_value=0.0,
            absolute_return=0.0,
            percentage_return=0.0,
            twr=0.0
        )

    # History is sorted by snapshot_date desc, we need asc for TWR
    history_asc = list(reversed(history))

    latest = history_asc[-1]

    current_value = float(latest.nav) if latest.nav else 0.0
    mean_cost = float(latest.mean_cost) if latest.mean_cost else 0.0
    participations = float(latest.participations) if latest.participations else 0.0

    if participations > 0 and mean_cost > 0:
        total_contributed = mean_cost * participations
    else:
        total_contributed = float(latest.contribution) if latest.contribution else 0.0

    absolute_return = current_value - total_contributed
    percentage_return = (absolute_return / total_contributed * 100) if total_contributed > 0 else 0.0

    # Calculate Time-Weighted Return (TWR)
    # TWR = [(1 + RN) * (1 + RN+1) ... ] - 1
    # Rn = (V_end - (V_begin + CF)) / (V_begin + CF)

    twr_multiplier = 1.0
    previous_nav = 0.0
    previous_contribution = 0.0

    for i, entry in enumerate(history_asc):
        nav = float(entry.nav) if entry.nav else 0.0

        # Contribution at this period.
        # Since 'contribution' usually tracks running total, the cash flow is the diff
        curr_total_contrib = 0.0
        if entry.participations and entry.mean_cost and float(entry.participations) > 0:
             curr_total_contrib = float(entry.participations) * float(entry.mean_cost)
        else:
             curr_total_contrib = float(entry.contribution) if entry.contribution else 0.0

        cash_flow = curr_total_contrib - previous_contribution

        # We only calculate return if there was an initial value or a cashflow
        base_value = previous_nav + cash_flow
        if base_value > 0:
             period_return = (nav - base_value) / base_value
             twr_multiplier *= (1 + period_return)

        previous_nav = nav
        previous_contribution = curr_total_contrib

    twr = (twr_multiplier - 1.0) * 100

    return AssetMetricsResponse(
        asset_id=asset_id,
        total_contributed=total_contributed,
        current_value=current_value,
        absolute_return=absolute_return,
        percentage_return=percentage_return,
        twr=twr
    )
