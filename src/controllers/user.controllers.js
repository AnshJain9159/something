import { asyncHandler } from "../utils/asyncHandler.js";
import  {ApiError}  from "../utils/ApiError.js";
import {User} from "../models/user.models.js";
import {uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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

    
    // const avatar = await uploadOnCloudinary(avatarLocalPath)

    // let coverImage = ""
    // if(coverLocalPath){
    //     //doubtful scene hoskta hai idhr
    //     coverImage = await uploadOnCloudinary(coverLocalPath) 
    // }

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

export{ registerUser}