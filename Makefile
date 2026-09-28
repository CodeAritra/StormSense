.PHONY: help install dev dev-api dev-web test build clean

help:
	@echo "StormSense - AI Thunderstorm and Lightning Nowcasting Prototype"
	@echo ""
	@echo "Usage:"
	@echo "  make install     Install all backend and frontend dependencies"
	@echo "  make dev         Run both API backend and React web dashboard"
	@echo "  make dev-api     Run FastAPI backend on port 8000"
	@echo "  make dev-web     Run Vite frontend dev server on port 5173"
	@echo "  make test        Run backend pytest suite"
	@echo "  make build       Build production frontend bundle"

install:
	pip install -r apps/api/requirements.txt
	cd apps/web && npm install

dev-api:
	python -m uvicorn apps.api.main:app --host 0.0.0.0 --port 8000 --reload

dev-web:
	cd apps/web && npm run dev

test:
	pytest apps/api/tests -v

build:
	cd apps/web && npm run build

clean:
	rm -rf apps/web/dist apps/web/node_modules apps/api/__pycache__ apps/api/stormsense.db
