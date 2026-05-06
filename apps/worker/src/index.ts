console.info('Worker started');

// TODO: Initialize pg-boss queue and register job handlers
process.on('SIGTERM', () => {
  console.info('Worker shutting down');
  process.exit(0);
});
