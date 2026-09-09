import { describe,expect,it } from "vitest"; import jwt from "jsonwebtoken"; import { Types } from "mongoose"; import { requireAuth } from "./auth";
describe("authentication ownership",()=>{
  it("derives identity from the JWT and ignores a body userId",()=>{process.env.JWT_SECRET="test-secret";const userA=new Types.ObjectId(),userB=new Types.ObjectId();const req:any={headers:{authorization:`Bearer ${jwt.sign({},"test-secret",{subject:String(userA)})}`},body:{userId:String(userB)}};let error:unknown;requireAuth(req,{} as any,(value?:unknown)=>{error=value});expect(error).toBeUndefined();expect(String(req.userId)).toBe(String(userA));expect(String(req.userId)).not.toBe(req.body.userId)});
  it("rejects requests without a token",()=>{const req:any={headers:{}};let error:any;requireAuth(req,{} as any,(value?:unknown)=>{error=value});expect(error?.statusCode).toBe(401)});
});
