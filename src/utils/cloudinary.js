import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null;
        
        const response = cloudinary.uploader.upload(
            localFilePath,{
                resource_type: 'auto',
            }
        )

        console.log('File uploaded to cloudinary: File Url:'+ response.url);
        //ek bar uplaod hogyi to server se hatado 
        return response;
        fs.unlinkSync(localFilePath);
    } catch (error) {
        console.log("Error uploading coverImage",error)
        fs.unlinkSync(localFilePath);
        return null;
    }
}

const deleteFromCloudinary = async (publicId) => {
    try {
        if(!publicId) return null;
        
        const result = await cloudinary.uploader.destroy(publicId)
        console.log('File deleted from cloudinary: Public Id:'+ publicId);
        return result;
    } catch (error) {
        console.log("Error deleting file from cloudinary", error);
        return null;
    }
}

export {uploadOnCloudinary,deleteFromCloudinary}