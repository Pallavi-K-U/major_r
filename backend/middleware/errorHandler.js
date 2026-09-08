export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  const response = {
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      status: statusCode,
    }
  };

  if (!isProduction) {
    response.error.stack = err.stack;
    response.error.details = err.details || null;
  }

  // Handle specific database/Mongoose validation errors
  if (err.name === 'ValidationError') {
    response.error.message = 'Validation Error';
    response.error.status = 400;
    if (!isProduction) {
      response.error.details = err.errors;
    }
    return res.status(400).json(response);
  }

  if (err.name === 'CastError') {
    response.error.message = 'Invalid Resource Identifier';
    response.error.status = 400;
    return res.status(400).json(response);
  }

  res.status(response.error.status).json(response);
};

export const notFoundHandler = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};
