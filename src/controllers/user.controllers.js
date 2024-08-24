import { asyncHandler } from "../utils/asyncHandler.js";
import  { ApiError }  from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import {uploadOnCloudinary ,deleteFromCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

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
    const coverLocalPath= req.files?.coverImage?.[0]?.path
    
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
        coverImage = await uploadOnCloudinary(coverLocalPath)
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

export{ 
    registerUser,
    loginUser,
    refreshAccessToken,
    logoutUser
}