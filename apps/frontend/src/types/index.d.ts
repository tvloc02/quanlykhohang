export interface PaginationParams {
  page: number;
  limit: number;
}

declare module 'xlsx/xlsx.mjs' {
  export const CFB: any;
}
