from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from database import get_session
from models import AssetMetricsResponse
from services import metrics_service

router = APIRouter(prefix="/api/assets", tags=["Metrics"])

@router.get("/{asset_id}/metrics", response_model=AssetMetricsResponse)
async def get_asset_metrics(asset_id: str, session: AsyncSession = Depends(get_session)):
    return await metrics_service.get_asset_metrics(asset_id, session)
