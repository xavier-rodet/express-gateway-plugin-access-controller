function mergeFiltersIntoResources(allowedResources, rejectedFilters) {
  return allowedResources.map(allowedResource => {
    allowedResource.filtersRejection = allowedResource.filtersRejection.map(
      filterRejection => {
        return Object.assign(
          filterRejection,
          rejectedFilters.find(
            rejectedFilter => rejectedFilter.filter === filterRejection.filter
          )
        );
      }
    );
    return allowedResource;
  });
}

function analyzeResourceURI(resource) {
  // Replace / to \\/
  let pattern = resource.replace(/\//g, '\\/');

  // Replace {owner:x} to (x)
  const ownerMatch = pattern.match(/{owner:([^}]*)}/);
  if (ownerMatch) {
    pattern = pattern.replace(
      '{owner:' + ownerMatch[1] + '}',
      '(' + ownerMatch[1] + ')'
    );
  }

  // Replace {x} to (x)
  pattern = pattern.replace(/{([^}]*)}/g, '$1');

  return [pattern, ownerMatch ? true : false];
}

function validateRequestMethod(requestMethod, allowedResource, owner, user) {
  return allowedResource.methods.some(
    method =>
      method.method === requestMethod &&
      (!method.requireOwner || (owner && owner === user))
  );
}

function validateRequestFilters(requestQuery, allowedResource, owner, user) {
  const hasRejectedFilter = allowedResource.filtersRejection.some(
    rejectedFilter => {
      console.log('checking rejectedFilter', rejectedFilter);
      if (
        // If we found a rejected filter in current query
        rejectedFilter.name in requestQuery &&
        // If rejected filter has no value to check
        (rejectedFilter.value === undefined ||
          // Or check Array value
          (Array.isArray(requestQuery[rejectedFilter.name]) &&
            requestQuery[rejectedFilter.name].indexOf(rejectedFilter.value) >=
              0) ||
          // Or check value
          requestQuery[rejectedFilter.name] == rejectedFilter.value)
      ) {
        console.log('filterRejection found', rejectedFilter.name);

        // We will detect rejected filter:
        // If it doesn't accept owner
        // Or Owner is not found
        // Or it's not the Owner
        if (!rejectedFilter.exceptOwner || !owner || owner !== user) {
          return true;
        } else {
          return false;
        }
      } else {
        return false;
      }
    }
  );

  return !hasRejectedFilter; // Return true if no rejected filters has been found
}

function validateRequest(request, allowedResources, user) {
  const isValidRequest = allowedResources.some(allowedResource => {
    const [pattern, hasOwner] = analyzeResourceURI(allowedResource.resource);
    const regexp = new RegExp('^' + pattern + '$');
    const matches = request.path.match(regexp);

    // If path matches a valid pattern
    if (matches) {
      console.log('match', regexp);

      const owner = matches[1] ? matches[1].toString() : undefined;

      return (
        validateRequestMethod(request.method, allowedResource, owner, user) &&
        validateRequestFilters(request.query, allowedResource, owner, user)
      );
    } else {
      return false;
    }
  });
}

// Insipred by : https://github.com/crohit92/express-gateway-plugin-jwt-extractor/blob/master/policies/jwt-extractor-policy.js
module.exports = {
  name: 'access-controller',
  policy: parameters => {
    return (req, res, next) => {
      const user = parameters.user ? eval(parameters.user) : undefined;

      if (parameters.rejectedFilters) {
        parameters.allowedResources = mergeFiltersIntoResources(
          parameters.allowedResources,
          parameters.rejectedFilters
        );
      }

      const isValidRequest = validateRequest(
        req,
        parameters.allowedResources,
        user
      );
      if (isValidRequest) {
        next();
      } else {
        res.status(403).send();
      }
    };
  },
  schema: {
    $id: 'http://express-gateway.io/schemas/policies/access-controller.json',
    type: 'object',
    properties: {
      user: {
        title: 'User',
        description:
          'Eval code representing the current auth user of the request',
        type: 'string'
      },
      rejectFilters: {
        title: 'Reject filters',
        description:
          'List of rejected filters which can be used into allowedResources',
        type: 'array'
      },
      allowedResources: {
        title: 'Allowed resources',
        description: 'List of allowed resources with optionnal reject filters',
        type: 'array'
      }
    },
    required: ['allowedResources']
  }
};
