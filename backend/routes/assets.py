from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from database import get_session
from models import Asset
from services import db_service

router = APIRouter(prefix="/api/assets", tags=["Assets"])

@router.get("", response_model=List[Asset])
async def get_assets(
    parent_id: Optional[str] = Query(None, description="Filter by parent asset ID. If null, returns only root assets."),
    include_all: bool = Query(False, description="If true, returns all assets including children. Overrides parent_id filter."),
    session: AsyncSession = Depends(get_session)
):
    """
    Get assets with hierarchical filtering.
    
    - By default, returns only root assets (parent_asset_id IS NULL)
    - If parent_id is specified, returns only children of that parent
    - If include_all=true, returns all assets regardless of hierarchy
    """
    if include_all:
        return await db_service.get_all_assets(session)
    
    return await db_service.get_assets_by_parent(session, parent_id)

@router.post("", response_model=Asset, status_code=status.HTTP_201_CREATED)
async def create_asset(asset: Asset, session: AsyncSession = Depends(get_session)):
    if await db_service.get_asset_by_id(session, asset.id):
        raise HTTPException(status_code=400, detail="Asset ID already exists")
    return await db_service.create_asset(session, asset)

@router.put("/{asset_id}", response_model=Asset)
async def update_asset(asset_id: str, asset: Asset, session: AsyncSession = Depends(get_session)):
    updated = await db_service.update_asset(session, asset_id, asset)
    if not updated:
        raise HTTPException(status_code=404, detail="Asset not found")
    return updated

@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(asset_id: str, session: AsyncSession = Depends(get_session)):
    if not await db_service.delete_asset(session, asset_id):
        raise HTTPException(status_code=404, detail="Asset not found")
