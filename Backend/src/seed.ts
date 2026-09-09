import dns from "node:dns";
import dotenv from "dotenv"; 
import bcrypt from "bcryptjs";
import { connectDatabase,disconnectDatabase } from "./config/database"; 
import { ensureDefaultCategories } from "./services/categories";
import { User } from "./models/User"; 
import { Account } from "./models/Account"; 
import { Category } from "./models/Category"; 
import { Budget } from "./models/Budget"; 
import { Goal } from "./models/Goal"; 
import { Transaction } from "./models/Transaction"; 
import { createTransaction } from "./services/transactions"; 

dns.setServers(["8.8.8.8", "1.1.1.1"]);
dotenv.config();
async function seed(){
    await connectDatabase();
    await ensureDefaultCategories();
    const email=process.env.DEMO_EMAIL||"demo@finora.app",
    password=process.env.DEMO_PASSWORD||"Demo@1234";
    let user=await User.findOne({email});
    if(!user)user=await User.create({
        name:"Demo User",
        email,
        passwordHash:await bcrypt.hash(password,12)
    });
    await Promise.all([
        Transaction.deleteMany({userId:user._id}),
        Account.deleteMany({userId:user._id}),
        Budget.deleteMany({userId:user._id}),
        Goal.deleteMany({userId:user._id})
    ]);
    const accounts=await Account.create([
        {userId:user._id,name:"SBI Savings",type:"bank",openingBalance:0,currentBalance:0},
        {userId:user._id,name:"Cash",type:"cash",openingBalance:3000,currentBalance:3000},
        {userId:user._id,name:"Emergency Savings",type:"savings",openingBalance:31000,currentBalance:31000},
        {userId:user._id,name:"Investment Account",type:"investment",openingBalance:16000,currentBalance:16000}
    ]);
    const cats=await Category.find({userId:null});
    const c=(name:string)=>String(cats.find(x=>x.name===name)!._id);
    const goal=await Goal.create({userId:user._id,name:"Emergency Fund",targetAmount:60000,targetDate:new Date(Date.now()+180*864e5)});
    const now=new Date(),base={transactionDate:now,accountId:String(accounts[0]._id)};
    await createTransaction(user._id,{...base,type:"income",title:"Salary",amount:25000,categoryId:c("Salary")});
    await createTransaction(user._id,{...base,type:"expense",title:"Groceries",amount:1250,categoryId:c("Food")});
    await createTransaction(user._id,{...base,type:"investment",title:"Monthly SIP",amount:4000,categoryId:c("SIP"),destinationAccountId:String(accounts[3]._id)});
    await createTransaction(user._id,{...base,type:"saving",title:"Emergency fund",amount:3000,goalId:String(goal._id),destinationAccountId:String(accounts[2]._id)});
    for(const[name,limit]of[["Food",5000],["Travel",3000],["Shopping",2500]]as const)await Budget.create({userId:user._id,categoryId:c(name),month:now.getMonth()+1,year:now.getFullYear(),limit});
    console.log(`Seeded ${email} / ${password}`);
    await disconnectDatabase()
}
seed().catch(e=>{console.error(e);process.exit(1)});
