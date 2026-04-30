import type { StreamConfig } from "../main";

export const validateFile = (file: File, config: StreamConfig) => {
  let isValid = true;

  if (file.size === 0) {
    isValid = false;
    return { isValid, message: "File is empty" };
  }

  if (file.size > config.maxFileSize!) {
    isValid = false;
    return { isValid, message: "File size exceeds the maximum allowed size" };
  }

  if (!config.allowedMimetypes!.includes(file.type)) {
    isValid = false;
    return { isValid, message: "File type is not allowed" };
  }

  return { isValid, message: "File is valid" };
};
