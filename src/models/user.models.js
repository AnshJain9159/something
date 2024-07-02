import mongoose, {Schema} from "mongoose";

const userSchema = new Schema(
    {
        username : {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },
        email: {
            type:String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        fullname: {
            type:String,
            required: true,
            trim: true,
            index: true,
        },
        avatar:{
            type: String, //url
            required: true
        },
        coverImage:{
            type: String, //url
        },
        watchHistory:[
            {
                type:Schema.Types.ObjectId,
                ref: "Video"
            }
        ],
        password: {
            type: String,
            required:[true,"Passowrd is required"]
        },
        refreshToken:{
            type: String
        },

    },
    {timestamps: true} //createdAT and updatedAt automatically aajayega
)

export const User= mongoose.model("User",userSchema)