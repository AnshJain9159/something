import { asyncHandler } from "../utils/asyncHandler.js";
import  { ApiError }  from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import {uploadOnCloudinary ,deleteFromCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

const registerUser = asyncHandler ( async(req, res) => {
    const {fullname,email,username,password} =  req.body
    //validation
    if(
        [fullname,username,email,password].some((field)=> field?.trim==="")
    ){
        throw new ApiError(400, "Full Name is required")
    }

    const existedUser = await User.findOne({
        $or: [{username},{email}]
    })

    if(existedUser){
        throw new ApiError(409, "Username or Email already exists")
    }

    const avatarLocalPath= req.files?.avatar?.[0]?.path
    const coverImageLocalPath= req.files?.coverImage?.[0]?.path
    
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar  file missing hai")
    }

    
    let avatar;
    try {
        avatar = await uploadOnCloudinary(avatarLocalPath)
        console.log("uploaded avatar",avatar)
    } catch (error) {
        console.log("Error uploading avatar",error)
        throw new ApiError(500, "Error uploading cover image")
    }

    let coverImage;
    try {
        coverImage = await uploadOnCloudinary(coverImageLocalPath)
        console.log("uploaded avatar",coverImage)
    } catch (error) {
        console.log("Error uploading coverImage",error)
        throw new ApiError(500, "Error uploading cover coverImage")
    }

    try {
        const user  = await User.create({
            fullname,
            avatar: avatar.url,
            coverImage: coverImage?.url || "",
            email,
            password,
            username:username.toLowerCase()    
        })
    
        const createdUser  = await User.findById(user._id).select(
            '-password -refreshToken'
        )
    
        if(!createdUser){
            throw new ApiError(500, "Something went wrong while registring the user")
        }
    
        return res.status(201).json(
            new ApiResponse(200,createdUser,"user registered successfully")
        );
    } catch (error) {
        console.log("User creation failed")
        if(avatar){
            await deleteFromCloudinary(avatar.public_id)
        }
        if(coverImage){
            await deleteFromCloudinary(coverImage.public_id)
        }
    } throw new ApiError(500, "Something went wrong while registring the user and images where deleted ")
})

const generateAccessAndRefreshToken = async (userId)=>{
    try {
        const user = await User.findById(userId)
        if(!user){
            throw new ApiError(404, "User not found")
        }
        const accessToken =  user.generateAccessToken()
        const refreshToken =  user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})
        return {accessToken, refreshToken};
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating token")
    }
}

const loginUser = asyncHandler (async(req, res) => {
    //get data from body 
    const{ email, username,password}= req.body
    //validation
    if(!email){
        throw new ApiError(400, "Email is required")
    }

    const user = await User.findOne({
        $or: [{username},{email}]
    })

    if(!user){
        throw new ApiError(404, "User not found")
    }

    //validate password

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid credentials")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await  User.findById(user._id)
        .select("-password -refreshToken");

    const options = {
        httpOnly:true,
        secure: process.env.NODE_ENV==="production"

    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(200,
            {user: loggedInUser,accessToken,refreshToken},
            "User Logged in successfully"
        ))

})

const refreshAccessToken = asyncHandler(async (req, res) =>{
    const incomingRefreshToken  = req.cookies.refreshToken || req.body.refreshToken
    if(!incomingRefreshToken){
        throw new ApiError(401, "Refresh token is required")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET,
        )

        const user = await User.findById(decodedToken?._id)
        if(!user){
            throw new ApiError(404, "Invalid refresh Token")
        }

        if(incomingRefreshToken !==user?.refreshToken){
            throw new ApiError(401, "Invalid refresh token")
        }

        const options = {
            httpOnly:true,
            secure: process.env.NODE_ENV==="production",
        }

        const {accessToken, refreshToken: newRefreshToken} = await generateAccessAndRefreshToken(user._id)

        return res
           .status(200)
           .cookie("accessToken", accessToken, options)
           .cookie("refreshToken", newRefreshToken, options)
           .json(new ApiResponse(200,
                {accessToken,
                    refreshToken:newRefreshToken
                },
                "Access token refreshed successfully"
            ))
    } catch (error) {
        throw new ApiError(500,"Something went wrong while refreshing acccess token ")
    }
})

const logoutUser = asyncHandler( async (req,res)=>{
     await User.findByIdAndUpdate(
        req.user_id,
        {
            $set:{
                refreshToken: undefined,
            }
        },
        {
            new:true
        }
     )

     const options = {
        httpOnly:true,
        secure: process.env.NODE_ENV==="production",
     }

     return res.status(200)
     .clearCookie("accessToken", options)
     .clearCookie("refreshToken", options)
     .json(new ApiResponse(200, {}, "User Logged out successfully"))
 
})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
   const {oldPassword,newPassword} = req.body

   const user = await User.findById(req.user?._id)

   const isPasswordValid = await user.isPasswordCorrect(oldPassword)
    if(!isPasswordValid){
        throw new ApiError(401, "Invalid old password")
    }

    user.password = newPassword

    await user.save({validateBeforeSave:false})

    return res.status(200).json(new ApiResponse(200,{},
        "Password changed successfully"
    ))
})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res.status(200).json(new ApiResponse(200,req.user,"current user details"))
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullname,email}=req.body

    if(!fullname || !email) {
        throw new ApiError(400, "Full Name and Email are required")
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullname,
                email: email
            }
        },
        {new:true}
    ).select("-password -refreshToken")

    return res.status(200).json(new ApiResponse(200,user,"User details updated successfully"))

})

const updateUserAvatar = asyncHandler(async(req,res)=>{
     const avatarLocalPath =  req.file?.path 
     if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file Required")
     }

     const avatar  = await uploadOnCloudinary(avatarLocalPath)

     if(!avatar.url){
        throw new ApiError(500, "Error while uploading avatar")
     }

     const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new:true}
     ).select("-password -refreshToken")

     return res.status(200).json(new ApiResponse(200,user,"User avatar updated successfully"))

})

const updateUserCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover Image file Required")
    }

    const coverImage  = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(500, "Error while uploading cover image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new:true}
     ).select("-password -refreshToken")

     return res.status(200).json(new ApiResponse(200,user,"User cover image updated successfully"))
})

const getUserChannelProfile = asyncHandler(async(req,res)=>{
   const { username } =  req.params
   
   if(!username?.trim()){
    throw new ApiError(400, "Username is required")
   }

   const channel  = await User.aggregate(
    [
        {
            $match:{
                username: username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup:{
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscriber:{
                    $cond:{
                        if:{
                            $in: [req.user?._id,"$subscribers.subscriber"]
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {   
            //project ke lie hai
            $project:{
                fullname: 1,
                username: 1,
                avatar: 1,
                coverImage: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscriber: 1,
                email:1
            }
        }
        
    ]
   )

   if(!channel?.length){
       throw new ApiError(404, "Channel not found")
   }

   return res
        .status(200)
        .json(new ApiResponse(200,channel[0],"User channel profile fetched successfully"))

})

const getWatchHistory = asyncHandler(async(req,res)=>{
    const user = await User.aggregate(
        [
            {
                $match:{
                    _id: new mongoose.Types.ObjectId(req.user?._id)
                }
            },
            {
                $lookup:{
                    from: "videos",
                    localField: "watchHistory",
                    foreignField: "_id",
                    as: "watchHistory",
                    pipeline:[
                        {
                            $lookup:{
                                from: "users",
                                localField: "owner",
                                foreignField: "_id",
                                as: "owners",
                                pipeline:[
                                    {
                                        $project:{
                                             fullname: 1,
                                             username: 1,
                                             avatar: 1
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            $addFields:{
                                owner: {
                                    $first: "owner"
                                }
                            }
                        }
                    ]
                }
            }
        ]
    )
    
    if(!user?.length){
        throw new ApiError(404, "User not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(200,user[0]?.watchHistory,"User watch history fetched successfully"))
 
})

export{ 
    registerUser,
    loginUser,
    refreshAccessToken,
    logoutUser,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory,
 
}