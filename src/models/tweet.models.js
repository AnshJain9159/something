import mongoose, {Schema} from "mongoose";

const tweetSchema = new Schema(
    {
       content: {
        type: String,
        required: true,
       },
       owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
       },

    },
    {timestamps: true} //createdAT and updatedAt automatically aajayega
)

export const Tweet= mongoose.model("Tweet",tweetSchema)