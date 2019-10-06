# codeserver-repository-importer

1 - Clone the target repository locally
2 - Create a branch from the first commit 
3 - Onboard the branch on CodeServer
4 - Execute this script to onboard the historical commits lazily

node codeserver-repository-loader.js --branch-target=my-test-branch2 
--owner=thiagoluizalves-org --repo=spring-boot-changed --repo-dir=/Users/thiagojfg/spring-boot-changed
