export const REPLAY_EXIT_CODES = {
  success: 0,
  replay_failed: 1,
  invalid_args: 64,
  invalid_case_file: 65,
  incompatible_case_file: 66,
  harness_error: 70,
  oracle_error: 71,
  user_code_timeout: 72,
  user_code_runtime_error: 73,
  user_code_output_limit: 74,
};

export const SELF_TEST_EXIT_CODES = {
  success: 0,
  self_test_failed: 1,
  invalid_args: 64,
  harness_error: 70,
  oracle_error: 71,
};

export const SUPPORT_EXIT_CODES = {
  success: 0,
  invalid_args: 64,
  harness_error: 70,
};
