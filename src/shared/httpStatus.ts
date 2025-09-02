export const HTTPGoodStatus = {
	OK: 200,
	CREATED: 201,
	ACCEPTED: 202,
	NO_CONTENT: 204,
	PARTIAL_CONTENT: 206,
} as const;

export const HTTPServerErrorStatus = {
	INTERNAL_SERVER_ERROR: 500,
	BAD_GATEWAY: 502,
	SERVICE_UNAVAILABLE: 503,
	GATEWAY_TIMEOUT: 504,
} as const;

export const HTTPBadStatus = {
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	METHOD_NOT_ALLOWED: 405,
	REQUEST_TIMEOUT: 408,
	CONFLICT: 409,
	UNPROCESSABLE_ENTITY: 422,
	TOO_MANY_REQUESTS: 429,
} as const;

export const HTTPStatusMap = {
	...HTTPGoodStatus,
	...HTTPBadStatus,
	...HTTPServerErrorStatus,
} as const;

export type THttpSuccessKeys = keyof typeof HTTPGoodStatus;
export type THttpErrorKeys =
	| keyof typeof HTTPBadStatus
	| keyof typeof HTTPServerErrorStatus;

export type TStatus = keyof typeof HTTPStatusMap;
export const getHTTPStatus = (status: TStatus) => HTTPStatusMap[status];
