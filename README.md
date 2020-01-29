# express-gateway-plugin-access-controller

This plugin for [Express Gateway](https://express-gateway.io) allow to easily control accces for your APIs.

When using this plugin, by default:

- All API resources are blacklisted
- All requests filters are whitelisted

## Installation

Simply type from your shell environment:

```bash
eg plugin install express-gateway-plugin-access-controller
```

## Quick start

1. Make sure the plugin is listed in [system.config.yml file](https://www.express-gateway.io/docs/configuration/system.config.yml/).
   This is done automatically for you if you used the command above.

2. Add the configuration keys to [gateway.config.yml file](https://www.express-gateway.io/docs/configuration/gateway.config.yml/).

In the exemples below, we are using 2 others plugins:

- [jwks plugin](https://github.com/DrMegavolt/express-gateway-plugin-jwks) : to validate our JWT Bearer
- [jwt-forwarder plugin](https://github.com/xavier-rodet/express-gateway-plugin-jwt-forwarder) : to extract in header our JWT "sub" field (for owner validity cases)

## Use case

```yaml
policies:
  - jwks:
  - jwt-forwarder:
  - access-controller:
      - action:
          # We define what represent the current auth user from the request (it will be evaled on runtime)
          user: 'req.get("x-jwt-sub")' # [OPTIONNAL] Will be compared to owner of the resource uri when using options like 'requireOwner' or 'exceptOwner'
          # We list rejected filters rules
          rejectFilters: # [OPTIONNAL]
            - filter: 'Account' # reject filter matching key & value (?account=details)
              key: 'account'
              value: 'details' # [OPTIONNAL]
            - filter: 'FieldExist' # reject filter matching key (?field_exist or ?field_exist=whatever)
              key: 'field_exist'
          # Last but not least, we list our allowed resources, where we can plug our desired rejected filters rules set above
          allowedResources: # [REQUIRED]
            - resource: '/api/users'
              methods:
                - method: 'GET'
              filtersRejection: # [OPTIONNAL]
                - filter: 'Account'
                - filter: 'FieldExist'
            - resource: '/api/users/{owner:\d+}' # we can catch required owner using "{owner:x}", we x is a standard regex pattern
              methods:
                - method: 'GET'
                - method: 'PUT'
                  requireOwner: true # [OPTIONNAL] Only owner is allowed to use this method
              filtersRejection: # [OPTIONNAL]
                - filter: 'Account'
                  exceptOwner: true # [OPTIONNAL] reject this filter excepted for owner
            - resource: '/api/users/{\d+}/friends' # we can use standard regex pattern inside "{}"
              methods:
                - method: 'GET'
              filtersRejection: # [OPTIONNAL]
                - filter: 'Account'
                - filter: 'FieldExist'
```

## Want to make your own plugin?

Just check out our [plugin development guide](https://www.express-gateway.io/docs/plugins/).
We can't wait to see your custom stuff in the Gateway!
