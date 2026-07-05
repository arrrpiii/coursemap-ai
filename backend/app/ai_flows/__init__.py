"""Direct Gemini calls for each CourseMap AI capability.

Each module exposes one public function that builds a prompt, calls
``ai_service.generate_text`` or ``generate_json``, and returns the
parsed result. No graphs, no state machines.
"""