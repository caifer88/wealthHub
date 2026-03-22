from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from database import get_session
from models import HistoryEntry, HistoryResponseDTO
from services import db_service

router = APIRouter(prefix="/api/history", tags=["History"])

@router.get("", response_model=List[HistoryResponseDTO])
async def get_history(session: AsyncSession = Depends(get_session)):
    return await db_service.get_all_history(session)

@router.get("/asset/{asset_id}", response_model=List[HistoryEntry])
async def get_asset_history(asset_id: str, session: AsyncSession = Depends(get_session)):
    return await db_service.get_history_by_asset(session, asset_id)

@router.post("", response_model=HistoryEntry, status_code=status.HTTP_201_CREATED)
async def create_history(entry: HistoryEntry, session: AsyncSession = Depends(get_session)):
    return await db_service.create_history_entry(session, entry)

@router.put("/{history_id}", response_model=HistoryEntry)
async def update_history(history_id: str, entry: HistoryEntry, session: AsyncSession = Depends(get_session)):
    updated = await db_service.update_history_entry(session, history_id, entry)
    if not updated:
        raise HTTPException(status_code=404, detail="History entry not found")
    return updated

@router.delete("/{history_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_history(history_id: str, session: AsyncSession = Depends(get_session)):
    if not await db_service.delete_history_entry(session, history_id):
        raise HTTPException(status_code=404, detail="History entry not found")
