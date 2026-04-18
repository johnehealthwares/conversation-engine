export type ValidationRule = {
  type: 'question-type' | 'required' | 'min' | 'max' | 'regex' | 'api';
  value?: any;
  message?: string;
};
