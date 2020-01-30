// Check if filter match with express.req.query
function isFilterMatchQuery(filter, requestQuery) {
  let isKeyMatching = false;
  let isValueMatching = false;

  // If we detect nested filters
  const matches = filter.key.match(/(.*)\[(.*)\]$/);
  if (matches) {
    if (matches[2] === '') {
      // groups[]=mm -> groups: ['mm']
      isKeyMatching = matches[1] in requestQuery;
      if (isKeyMatching)
        isValueMatching = requestQuery[matches[1]].indexOf(filter.value) >= 0;
    } else {
      // mmTokens[exists]=1 -> mmToken: {exists: '1'}
      isKeyMatching =
        matches[1] in requestQuery && matches[2] in requestQuery[matches[1]];
      if (isKeyMatching)
        isValueMatching = requestQuery[matches[1]][matches[2]] === filter.value;
    }
  } else {
    // key=value
    isKeyMatching = filter.key in requestQuery;
    if (isKeyMatching)
      isValueMatching = requestQuery[filter.key] === filter.value;
  }

  if (filter.value === undefined) {
    return isKeyMatching;
  } else {
    return isKeyMatching && isValueMatching;
  }
}

function mergeFiltersIntoResources(allowedResources, rejectedFilters) {
  return allowedResources.map(allowedResource => {
    allowedResource.filtersRejection = allowedResource.filtersRejection.map(
      resourceFilter => {
        // Get rejected filter configuration
        let rejectedFilter = rejectedFilters.find(
          rejectedFilter => rejectedFilter.filter === resourceFilter.filter
        );

        // Merge it to resource
        return Object.assign(resourceFilter, rejectedFilter);
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

function validateRequestMethod(requestMethod, allowedMethods, owner, user) {
  return allowedMethods.some(
    method =>
      method.method === requestMethod &&
      (!method.requireOwner || (owner && owner === user))
  );
}

function validateRequestFilters(requestQuery, rejectedFilters, owner, user) {
  const hasRejectedFilter = rejectedFilters.some(rejectedFilter => {
    if (isFilterMatchQuery(rejectedFilter, requestQuery)) {
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
  });

  return !hasRejectedFilter; // Return true if no rejected filters has been found
}

function validateRequest(request, allowedResources, user) {
  return allowedResources.some(allowedResource => {
    const [pattern, hasOwner] = analyzeResourceURI(allowedResource.resource);
    const regexp = new RegExp('^' + pattern + '$');
    const matches = request.path.match(regexp);

    // If path matches a valid pattern
    if (matches) {
      const owner = matches[1] ? matches[1].toString() : undefined;

      return (
        validateRequestMethod(
          request.method,
          allowedResource.methods,
          owner,
          user
        ) &&
        (!allowedResource.filtersRejection ||
          validateRequestFilters(
            request.query,
            allowedResource.filtersRejection,
            owner,
            user
          ))
      );
    } else {
      return false;
    }
  });
}

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
      rejectedFilters: {
        title: 'Rejected filters',
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
