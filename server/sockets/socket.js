const { QueueEvents } = require('bullmq');
const Job = require('../models/Job');

module.exports = (io) => {
  const queueEvents = new QueueEvents('thumbnail-queue', { connection: { host: 'redis', port: 6379 } });

  queueEvents.on('progress', async ({ jobId }) => {
    const job = await Job.findById(jobId);
    io.to(job.userId.toString()).emit('jobUpdate', job);
  });

  queueEvents.on('completed', async ({ jobId }) => {
    const job = await Job.findById(jobId);
    io.to(job.userId.toString()).emit('jobUpdate', job);
  });

  queueEvents.on('failed', async ({ jobId }) => {
    const job = await Job.findById(jobId);
    io.to(job.userId.toString()).emit('jobUpdate', job);
  });

  io.on('connection', (socket) => {
    socket.on('join', (userId) => {
      socket.join(userId);
    });
  });
};
