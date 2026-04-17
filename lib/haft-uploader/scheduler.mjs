import cron from "node-cron";

export function createScheduler({ reloadConfig, runTaskById }) {
  let jobs = [];
  let running = false;

  return {
    async start() {
      await this.stop();
      const appConfig = await reloadConfig();
      const enabledTasks = appConfig.tasks.filter((task) => task.enabled);

      jobs = enabledTasks.map((task) =>
        cron.schedule(task.schedule, async () => {
          await runTaskById(task.id);
        }),
      );

      running = true;
      return enabledTasks.length;
    },
    async stop() {
      for (const job of jobs) {
        job.stop();
        job.destroy();
      }
      jobs = [];
      running = false;
    },
    getStatus() {
      return {
        running,
        jobCount: jobs.length,
      };
    },
  };
}
