#!/bin/bash
# Restart script for Local Website Manager
# Stops old backend and frontend if running, then starts them again

set -e

cd "$(dirname "$0")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Website Manager Restart Script ===${NC}"

# Function to kill process on a specific port
kill_port() {
    local port=$1
    local service_name=$2
    
    echo -e "${YELLOW}Checking for $service_name on port $port...${NC}"
    
    # Find PIDs using the port
    local pids=$(lsof -ti :$port 2>/dev/null || true)
    
    if [ -z "$pids" ]; then
        echo -e "${GREEN}✓ No $service_name process found on port $port${NC}"
        return 0
    fi
    
    echo -e "${YELLOW}Found $service_name process(es): $pids${NC}"
    
    # Kill each PID
    for pid in $pids; do
        echo -e "${YELLOW}Stopping PID $pid...${NC}"
        kill -15 $pid 2>/dev/null || kill -9 $pid 2>/dev/null || true
        sleep 1
    done
    
    # Verify the port is free
    if lsof -ti :$port >/dev/null 2>&1; then
        echo -e "${RED}✗ Failed to stop $service_name on port $port${NC}"
        return 1
    else
        echo -e "${GREEN}✓ Successfully stopped $service_name${NC}"
        return 0
    fi
}

# Function to kill process by name pattern
kill_by_pattern() {
    local pattern=$1
    local service_name=$2
    
    echo -e "${YELLOW}Checking for $service_name processes...${NC}"
    
    # Find PIDs matching the pattern
    local pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    
    if [ -z "$pids" ]; then
        echo -e "${GREEN}✓ No $service_name processes found${NC}"
        return 0
    fi
    
    echo -e "${YELLOW}Found $service_name process(es): $pids${NC}"
    
    # Kill each PID
    for pid in $pids; do
        echo -e "${YELLOW}Stopping PID $pid...${NC}"
        kill -15 $pid 2>/dev/null || kill -9 $pid 2>/dev/null || true
        sleep 1
    done
    
    echo -e "${GREEN}✓ Successfully stopped $service_name${NC}"
    return 0
}

# Stop backend (Flask on port 5000)
echo ""
echo -e "${GREEN}=== Stopping Backend ===${NC}"
kill_port 5000 "Backend (Flask)"

# Also kill any Python processes running app.py
kill_by_pattern "python.*app.py" "Backend Python"

# Stop frontend (Vite dev server, typically on port 5173)
echo ""
echo -e "${GREEN}=== Stopping Frontend ===${NC}"
kill_port 5173 "Frontend (Vite)"

# Also kill any npm/node processes for the frontend
kill_by_pattern "vite.*frontend" "Frontend Vite"

echo ""
echo -e "${GREEN}=== All services stopped ===${NC}"
echo ""
sleep 2

# Start backend
echo -e "${GREEN}=== Starting Backend ===${NC}"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/update dependencies
echo -e "${YELLOW}Installing backend dependencies...${NC}"
pip install -q -r requirements.txt

# Start backend in background
echo -e "${YELLOW}Starting Flask backend on port 5000...${NC}"
nohup python3 app.py > backend.log 2>&1 &
BACKEND_PID=$!

echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"
echo -e "${GREEN}  Access at: http://127.0.0.1:5000${NC}"

# Wait a bit for backend to start
sleep 3

# Start frontend
echo ""
echo -e "${GREEN}=== Starting Frontend ===${NC}"

cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    npm install
fi

# Start frontend in background
echo -e "${YELLOW}Starting Vite dev server...${NC}"
nohup npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!

echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"
echo -e "${GREEN}  Access at: http://localhost:5173${NC}"

cd ..

echo ""
echo -e "${GREEN}=== Restart Complete ===${NC}"
echo ""
echo -e "${GREEN}Services running:${NC}"
echo -e "  Backend:  http://127.0.0.1:5000 (PID: $BACKEND_PID)"
echo -e "  Frontend: http://localhost:5173 (PID: $FRONTEND_PID)"
echo ""
echo -e "${YELLOW}Logs:${NC}"
echo -e "  Backend:  tail -f backend.log"
echo -e "  Frontend: tail -f frontend.log"
echo ""
echo -e "${YELLOW}To stop services:${NC}"
echo -e "  kill $BACKEND_PID $FRONTEND_PID"
echo ""