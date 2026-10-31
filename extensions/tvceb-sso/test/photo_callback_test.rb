# Standalone boundary test: no Rails database or family credentials required.
require "ostruct"
module Devise
  class OmniauthCallbacksController
    attr_accessor :request
    attr_reader :result
    def sign_in_and_redirect(user, **); @result = [:signed_in, user.id]; end
    def redirect_to(*, **); @result = [:denied]; end
    def new_user_session_path; "/users/sign_in"; end
  end
end
module Rails
  def self.application; @application; end
  def self.application=(value); @application = value; end
end
class User
  class << self; attr_accessor :fixture; end
  def self.find_by(id:); fixture if fixture&.id == id; end
end
load File.expand_path("../adapters/family-photo-share/family_oidc_callbacks_controller.rb", __dir__)
mapping = {"subject" => "broker-child", "username" => "child1", "userId" => 7, "expectedEmail" => "child1@family.test"}
Rails.application = OpenStruct.new(config: OpenStruct.new(x: OpenStruct.new(family_oidc: {"members" => [mapping]})))
user = OpenStruct.new(id: 7, email: "child1@family.test", family_role: "child")
def user.active_for_authentication?; true; end
User.fixture = user
valid = {"sub" => "broker-child", "email_verified" => true, "groups" => ["TVceb Family"], "preferred_username" => "child1"}
checks = 0
run = lambda do |raw, uid = "broker-child", provider = "openid_connect"|
  controller = FamilyOidcCallbacksController.new
  controller.request = OpenStruct.new(env: {"omniauth.auth" => OpenStruct.new(provider: provider, uid: uid, extra: OpenStruct.new(raw_info: raw))})
  controller.openid_connect
  controller.result
end
raise "valid child not linked" unless run.call(valid) == [:signed_in, 7]
raise "family role changed" unless user.family_role == "child"
checks += 2
[{"sub" => "other"}, {"email_verified" => false}, {"groups" => ["administrators"]}, {"preferred_username" => "admin"}].each do |override|
  raise "unsafe claims accepted" unless run.call(valid.merge(override)) == [:denied]
  checks += 1
end
raise "unknown identity accepted" unless run.call(valid.merge("sub" => "unknown"), "unknown") == [:denied]
checks += 1
user.email = "different@family.test"
raise "changed account accepted" unless run.call(valid) == [:denied]
checks += 1
user.email = "child1@family.test"
def user.active_for_authentication?; false; end
raise "locked account accepted" unless run.call(valid) == [:denied]
checks += 1
puts "#{checks} Photo Share callback checks passed"
