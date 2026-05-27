const success = (res, data = {}, message = 'Success', code = 200) => {
  return res.status(code).json({ status: '1', message, data });
};

const error = (res, message = 'Error', code = 400, errors = null) => {
  const response = { status: '0', message };
  if (errors) response.errors = errors;
  return res.status(code).json(response);
};

module.exports = { success, error };
