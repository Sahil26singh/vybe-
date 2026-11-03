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

/**
 * Route middleware to validate that one or more req.params are valid ObjectIds
 */
export const validateObjectId = (paramNames = ["id"]) => {
  const names = Array.isArray(paramNames) ? paramNames : [paramNames];
  return (req, res, next) => {
    for (const name of names) {
      const val = req.params[name];
      if (val && !mongoose.isValidObjectId(val)) {
        return res.status(400).json({
          message: `Invalid ${name}: '${val}' is not a valid ObjectId`,
          success: false,
        });
      }
    }
    next();
  };
};

export default validateObjectId;

