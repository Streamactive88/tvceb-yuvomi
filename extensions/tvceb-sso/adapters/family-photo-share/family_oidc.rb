if ENV["FAMILY_OIDC_ENABLED"] == "true"
  require "json"
  require "uri"
  config = JSON.parse(File.read(ENV.fetch("FAMILY_OIDC_CONFIG_FILE")))
  %w[issuer redirectUri].each do |key|
    uri = URI.parse(config.fetch(key))
    raise "Family OIDC requires HTTPS" unless uri.is_a?(URI::HTTPS) && !uri.userinfo && !uri.query && !uri.fragment
  end
  members = config.fetch("members")
  raise "Family OIDC requires explicit members" if members.empty?
  %w[subject userId username expectedEmail].each do |key|
    values = members.map { |m| m.fetch(key).to_s }
    raise "Duplicate or empty family mapping" if values.any?(&:empty?) || values.uniq.length != values.length
  end
  Rails.application.config.x.family_oidc = config
  Devise.setup do |devise|
    devise.omniauth :openid_connect,
      name: :openid_connect, issuer: config.fetch("issuer"), discovery: true,
      scope: %i[openid profile email groups], response_type: :code,
      uid_field: "sub", pkce: true, send_nonce: true,
      client_options: {identifier: config.fetch("clientId"), secret: config.fetch("clientSecret"), redirect_uri: config.fetch("redirectUri")}
  end
  OmniAuth.config.allowed_request_methods = [:post]
  Rails.application.config.filter_parameters += [:code, :id_token, :access_token, :client_secret]
end
