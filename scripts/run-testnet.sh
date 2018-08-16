#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# Executes cleanup function at script exit.
trap cleanup EXIT

cleanup() {
  # Kill the testrpc instance that we started (if we started one and if it's still running).
  if [ -n "$testrpc_pid" ] && ps -p $testrpc_pid > /dev/null; then
    kill -9 $testrpc_pid
  fi
}

mnemonic=`cat ./mnemonic`

testrpc_running() {
  nc -z localhost "$testrpc_port"
}

testrpc_port=8555

start_testrpc() {

  node_modules/.bin/ganache-cli  --gasLimit 0xfffffffffff -m "${mnemonic}"

  testrpc_pid=$!
}

if testrpc_running; then
  echo "Using existing testrpc instance"
else
  echo "Starting our own testrpc instance"
  start_testrpc
fi
