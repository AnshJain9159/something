import mongoose, {Schema} from "mongoose";

const subscriptionSchema = new Schema(
    {
        subscriber: {
            type:Schema.Types.ObjectId, //jo subscriber kar rha hai
            ref: "User",
        },
        channel:{
            type: Schema.Types.ObjectId, //jo sybscribe horha hai
            ref: "User",
        }

    },
    {timestamps: true} //createdAT and updatedAt automatically aajayega
)

export const Subscription= mongoose.model("Subscription",subscriptionSchema)