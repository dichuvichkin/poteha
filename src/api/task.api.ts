const TASK_URL = 'https://s3-eu-west-1.amazonaws.com/poteha-job-interview-uploads/f98f8e9a-24d0-4c2c-a481-bcfd15c140d4/task.json';

export interface IFrame {
  id: number;
  url: string;
  marked?: boolean;
}

export interface ITask {
  task_id: string;
  task_title: string;
  frames: IFrame[];
}

export function getTaskData(): Promise<ITask> {
  return fetch(TASK_URL).then(response => response.json());
}
