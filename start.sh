#!/usr/bin/env bash
# Legacy launcher - superseded by ./haven (up|down|status|doctor).
exec "$(cd "$(dirname "$0")" && pwd)/haven" up
