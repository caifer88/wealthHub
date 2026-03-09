from sqlmodel.ext.asyncio.session import AsyncSession
from models import PortfolioSummaryResponse, PortfolioAllocationResponse
from services import db_service

async def get_portfolio_summary(session: AsyncSession) -> PortfolioSummaryResponse:
    """Get the latest portfolio summary"""
    latest_history = await db_service.get_latest_portfolio_history(session)
    all_assets = await db_service.get_all_assets(session)
    active_assets_dict = {a.id: a for a in all_assets if not a.is_archived}

    total_value = 0.0
    total_invested = 0.0
    cash_value = 0.0

    # Pre-fetch all history to avoid N+1 queries
    all_history = await db_service.get_all_history(session)
    history_by_asset = {}
    for h in all_history:
        if h.asset_id not in history_by_asset:
            history_by_asset[h.asset_id] = []
        history_by_asset[h.asset_id].append(h)

    from models import AssetCategory

    for history in latest_history:
        if history.asset_id in active_assets_dict:
            asset = active_assets_dict[history.asset_id]
            nav = float(history.nav) if history.nav else 0.0

            if asset.category == AssetCategory.CASH:
                cash_value += nav
                continue

            # Check if it's a sub-component (i.e. has a parent_asset_id)
            if asset.parent_asset_id is not None:
                continue

            # We calculate total invested as the sum of all historical contributions
            asset_history_entries = history_by_asset.get(asset.id, [])
            invested = sum([float(h.contribution) if h.contribution else 0.0 for h in asset_history_entries])

            total_value += nav
            total_invested += invested

    absolute_roi = total_value - total_invested
    percentage_roi = (absolute_roi / total_invested * 100) if total_invested > 0 else 0.0

    return PortfolioSummaryResponse(
        total_value=total_value,
        total_invested=total_invested,
        absolute_roi=absolute_roi,
        percentage_roi=percentage_roi,
        cash_value=cash_value
    )


async def get_portfolio_allocation(session: AsyncSession) -> PortfolioAllocationResponse:
    """Get the portfolio allocation by category"""
    latest_history = await db_service.get_latest_portfolio_history(session)
    assets = await db_service.get_all_assets(session)

    asset_dict = {a.id: a for a in assets if not a.is_archived}

    total_value = 0.0
    allocations = {}

    for history in latest_history:
        if history.asset_id in asset_dict:
            asset = asset_dict[history.asset_id]
            nav = float(history.nav) if history.nav else 0.0

            total_value += nav
            if asset.category not in allocations:
                allocations[asset.category] = 0.0
            allocations[asset.category] += nav

    if total_value > 0:
        for cat in allocations:
            allocations[cat] = (allocations[cat] / total_value) * 100

    return PortfolioAllocationResponse(allocations=allocations)
