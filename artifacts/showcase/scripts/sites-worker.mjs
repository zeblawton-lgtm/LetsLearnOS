import handler from "./vinext-handler.js";

export default {
  fetch(request, environment, context) {
    return handler(request, environment, context);
  },
};
