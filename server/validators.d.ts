import { RequestHandler } from "express";

export const studentLoginSchema: any;
export const studentParamSchema: any;
export const registrationPrewarmSchema: any;
export const registrationPortalStatusSchema: any;
export const registrationExecuteSchema: any;
export const registrationTestRequestSchema: any;
export const registrationCheckSeatsSchema: any;
export const registrationSnipeCheckSchema: any;
export const syncPtukSchema: any;
export const coursesQuerySchema: any;
export const courseCodeParamSchema: any;
export const majorParamSchema: any;
export const majorBodySchema: any;

export function validateBody(schema: any): RequestHandler;
export function validateParams(schema: any): RequestHandler;
export function validateQuery(schema: any): RequestHandler;
