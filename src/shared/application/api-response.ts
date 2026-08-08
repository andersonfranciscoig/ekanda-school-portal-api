export type ApiSuccessResponse<T> = {
  data: T;
  message: string;
};

export function ok<T>(
  data: T,
  message = 'Operation completed successfully',
): ApiSuccessResponse<T> {
  return { data, message };
}
