class FamilyOidcCallbacksController < Devise::OmniauthCallbacksController
  def openid_connect
    auth = request.env.fetch("omniauth.auth")
    config = Rails.application.config.x.family_oidc
    raw = auth.extra.raw_info.to_h.transform_keys(&:to_s)
    subject = auth.uid.to_s
    raise SecurityError unless auth.provider == "openid_connect" && raw["sub"].to_s == subject
    raise SecurityError unless raw["email_verified"] == true && Array(raw["groups"]).include?("TVceb Family")
    mapping = config.fetch("members").find { |m| m.fetch("subject") == subject }
    raise SecurityError unless mapping && raw["preferred_username"] == mapping.fetch("username")
    user = User.find_by(id: mapping.fetch("userId"))
    raise SecurityError unless user && user.email == mapping.fetch("expectedEmail") && user.active_for_authentication?
    # The existing user's family membership and album permissions are unchanged.
    sign_in_and_redirect user, event: :authentication
  rescue SecurityError, KeyError
    redirect_to new_user_session_path, alert: "Family sign-in is unavailable for this account. Ask a parent for help."
  end

  def failure
    redirect_to new_user_session_path, alert: "Family sign-in could not be completed. Please try again."
  end
end
