import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs';
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
        fs.unlinkSync(localFilePath);
        return null;
    }
}

export {uploadOnCloudinary}