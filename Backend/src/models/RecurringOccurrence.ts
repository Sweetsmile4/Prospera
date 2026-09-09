import {Schema,model} from "mongoose";
const schema=new Schema({userId:{type:Schema.Types.ObjectId,required:true},recurringTransactionId:{type:Schema.Types.ObjectId,required:true},scheduledDate:{type:Date,required:true},transactionId:{type:Schema.Types.ObjectId,ref:"Transaction"}},{timestamps:true});
schema.index({recurringTransactionId:1,scheduledDate:1},{unique:true});
export const RecurringOccurrence=model("RecurringOccurrence",schema);
