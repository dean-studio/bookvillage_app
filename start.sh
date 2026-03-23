#!/bin/bash
SESSION="bookvillage"
PROJECT_DIR="/Users/hazbola/works/bookvillage"

# 기존 세션이 있으면 붙기
if tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux attach -t "$SESSION"
  exit 0
fi

# 새 세션 생성 + claude 팀 리더 실행 (자동으로 에이전트 팀 구성)
tmux new-session -s "$SESSION" -d -c "$PROJECT_DIR" \
  "claude --dangerously-skip-permissions -p '에이전트 팀을 구성해줘. MEMORY.md를 참고해서 bookvillage 팀을 만들고 frontend, backend, devops 3개 에이전트를 spawn해줘. 왼쪽 pane(리더)은 넓게 설정해줘.'"

# 리더 pane 크기 조정 (세션 생성 후 잠시 대기)
sleep 2
tmux resize-pane -t "$SESSION":0.0 -R 30

tmux attach -t "$SESSION"
