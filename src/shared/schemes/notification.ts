export type Notification = {
  type: "info" | "warning" | "error";
  message: string;
  details?: string;
  timestamp: Date;
};
