# codeserver-repository-importer

You must create a branch with the fist commit only, 
after onboard the repository to CodeServer and then execute this script to 
load the historical commits lazily

node codeserver-repository-loader.js --branch-target=my-test-branch2 
--owner=thiagoluizalves-org --repo=spring-boot-changed --repo-dir=/Users/thiagojfg/spring-boot-changed
