import * as fs from "fs";
import CircleCI from "@circleci/circleci-config-sdk";

const config = new CircleCI.Config();
const workflow = new CircleCI.Workflow("test-lint");
config.addWorkflow(workflow);

const nodeExecutor = new CircleCI.executors.DockerExecutor("cimg/node:14.18");
const phpExecutor = new CircleCI.executors.DockerExecutor("cimg/php:8.1");
const e2eExecutor = new CircleCI.executors.MachineExecutor(
  "large",
  "ubuntu-2004:202111-02"
);

const manifest: CircleCI.types.orb.OrbImportManifest = {
  jobs: {},
  commands: {
    "install-packages": new CircleCI.parameters.CustomParametersList(),
  },
  executors: {},
};

const nodeOrb = new CircleCI.orb.OrbImport(
  "node",
  "circleci",
  "node",
  "5.0",
  undefined,
  manifest
);
const phpOrb = new CircleCI.orb.OrbImport(
  "php",
  "circleci",
  "php",
  "1.1",
  undefined,
  manifest
);

config.importOrb(nodeOrb);
config.importOrb(phpOrb);

const jobs = [
  new CircleCI.Job("js-build", nodeExecutor, [
    new CircleCI.commands.Checkout(),
    new CircleCI.reusable.ReusedCommand(nodeOrb.commands["install-packages"]),
    new CircleCI.commands.Run({
      name: "Running JS linting and unit test",
      command: `npm run lint:js \n npm run test:js`,
    }),
  ]),
  new CircleCI.Job("php-lint", phpExecutor, [
    new CircleCI.commands.Checkout(),
    new CircleCI.reusable.ReusedCommand(phpOrb.commands["install-packages"]),
    new CircleCI.commands.Run({ command: "composer lint" }),
  ]),
  new CircleCI.Job("php-test", phpExecutor, [
    new CircleCI.commands.Checkout(),
    new CircleCI.reusable.ReusedCommand(phpOrb.commands["install-packages"]),
    new CircleCI.commands.Run({ command: "composer test" }),
  ]),
  new CircleCI.Job("e2e-test", e2eExecutor, [
    new CircleCI.commands.Checkout(),
    new CircleCI.reusable.ReusedCommand(nodeOrb.commands["install-packages"]),
    new CircleCI.commands.Run({
      name: "Running e2e tests",
      command: "npm run wp-env start && npm run test:e2e",
    }),
    new CircleCI.commands.StoreArtifacts({ path: "artifacts" }),
  ]),
];

jobs.forEach((job) => {
  config.addJob(job);
  workflow.addJob(job);
});

fs.writeFile("./dynamicConfig.yml", config.stringify(), () => {});
