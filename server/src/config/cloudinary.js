import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dtqgsh60c",
  api_key: process.env.CLOUDINARY_API_KEY || "486892228652825",
  api_secret: process.env.CLOUDINARY_API_SECRET || "LtBlvxegAggVTbcYJpyUAPS7eQI",
  secure: true,
});

export default cloudinary;
