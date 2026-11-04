import mongoose from "mongoose";

/**
 * Express router.param helper for validating param IDs
 */
export const validateParamId = (paramName = "id") => {
  return (req, res, next, id) => {
    if (id && !mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: `Invalid ${paramName}: '${id}' is not a valid ObjectId`,
        success: false,
      });
    }
    next();
  };
};

export default validateParamId;

