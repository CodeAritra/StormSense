import asyncio
import json
import logging
from typing import Set, Optional
from fastapi import WebSocket
from .models import ReplayState
from .config import REPLAY_TICK_SECONDS, EVENTS_DIR

logger = logging.getLogger("stormsense.replay")

class ReplayEngine:
    def __init__(self):
        self.event_id: Optional[str] = "evt_001"
        self.playing: bool = False
        self.speed: float = 1.0
        self.current_index: int = 12
        self.n_frames: int = 49
        self.max_index: int = 36  # 49 - 13 = 36
        self._active_connections: Set[WebSocket] = set()
        self._task: Optional[asyncio.Task] = None

    def load_event_meta(self, event_id: str):
        self.event_id = event_id
        json_file = EVENTS_DIR / f"{event_id}.json"
        if json_file.exists():
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.n_frames = data.get("n_frames", 49)
                    self.max_index = max(12, self.n_frames - 13)
            except Exception as e:
                logger.error(f"Error loading event meta: {e}")
                self.n_frames = 49
                self.max_index = 36
        else:
            self.n_frames = 49
            self.max_index = 36

    def get_state(self) -> ReplayState:
        return ReplayState(
            event_id=self.event_id,
            playing=self.playing,
            speed=self.speed,
            current_index=self.current_index,
            n_frames=self.n_frames,
            max_index=self.max_index
        )

    async def start(self, event_id: str = "evt_001", speed: float = 1.0, start_index: int = 12):
        self.load_event_meta(event_id)
        self.speed = max(0.25, min(10.0, speed))
        self.current_index = max(12, min(self.max_index, start_index))
        self.playing = True
        await self.broadcast()

    async def pause(self):
        self.playing = False
        await self.broadcast()

    async def resume(self):
        if self.current_index >= self.max_index:
            self.current_index = 12
        self.playing = True
        await self.broadcast()

    async def seek(self, index: int):
        self.current_index = max(12, min(self.max_index, index))
        await self.broadcast()

    async def register(self, ws: WebSocket):
        await ws.accept()
        self._active_connections.add(ws)
        # Send current state immediately on connect
        await ws.send_text(self.get_state().model_dump_json())

    def unregister(self, ws: WebSocket):
        self._active_connections.discard(ws)

    async def broadcast(self):
        if not self._active_connections:
            return
        state_json = self.get_state().model_dump_json()
        disconnected = set()
        for ws in self._active_connections:
            try:
                await ws.send_text(state_json)
            except Exception:
                disconnected.add(ws)
        for ws in disconnected:
            self._active_connections.discard(ws)

    async def tick_loop(self):
        logger.info("Replay engine tick loop started")
        while True:
            try:
                interval = max(0.2, REPLAY_TICK_SECONDS / self.speed)
                await asyncio.sleep(interval)
                if self.playing:
                    if self.current_index < self.max_index:
                        self.current_index += 1
                        await self.broadcast()
                    else:
                        self.playing = False
                        await self.broadcast()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in replay tick loop: {e}")

replay_engine = ReplayEngine()
