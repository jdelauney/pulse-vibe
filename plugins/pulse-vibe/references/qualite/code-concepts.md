---
title: Code concepts
description: Complete reference for code smells, SOLID principles, and refactoring patterns
version: 1.2
---

<refactoring_library>

  <principles>

    <principle id="KISS" name="Keep It Simple, Stupid">
      <description>Simplicity should be a key goal in design. Keep complexity to what the problem requires.</description>
      <indicators>Overly clever one-liners that sacrifice readability ; Deep nesting (> 3 levels) ; Functions doing multiple unrelated things ; Premature optimization ; Abstract factories for single implementations</indicators>
      <refactoring>Break complex expressions into named intermediate variables ; Flatten nested conditions with early returns (guard clauses) ; Split multi-purpose functions into single-purpose ones ; Remove abstractions that don't earn their complexity</refactoring>
    </principle>

    <principle id="DRY" name="Don't Repeat Yourself">
      <description>Every piece of knowledge must have a single, unambiguous representation.</description>
      <indicators>Copy-pasted code blocks ; Similar logic in multiple places with slight variations ; Magic numbers/strings repeated across files ; Parallel class hierarchies</indicators>
      <refactoring>Extract common logic into reusable functions ; Create shared utilities or helper modules ; Define constants for repeated values ; Use parameterization to unify similar code paths</refactoring>
      <caution>Distinguish accidental duplication from true duplication - similar-looking code serving different purposes may diverge later</caution>
    </principle>

    <principle id="YAGNI" name="You Ain't Gonna Need It">
      <description>Add functionality only when it's actually needed.</description>
      <indicators>Unused parameters or methods ; Speculative generality (interfaces with one implementation) ; Feature flags for features never shipped ; Dead code paths</indicators>
      <refactoring>Remove unused code ruthlessly ; Eliminate unnecessary abstractions ; Limit changes to what is needed now, leaving "nice to have" improvements aside ; Keep refactoring scope strictly defined</refactoring>
    </principle>

    <principle_group id="SOLID" name="SOLID Design Principles">
      <principle id="SRP" name="Single Responsibility Principle">
        <description>A module should have one, and only one, reason to change.</description>
        <indicators>Classes with "And" in the name (UserAndOrderManager) ; Functions or methods longer than 30 lines ; Classes that change for multiple unrelated reasons ; God classes that know too much ; More than 5-7 dependencies injected</indicators>
        <patterns>Extract Class ; Extract Method ; Move Method</patterns>
      </principle>

      <principle id="OCP" name="Open/Closed Principle">
        <description>Open for extension, closed for modification.</description>
        <indicators>Switch statements on type codes ; Frequent modifications to existing classes for new features ; Long if-else chains checking object types</indicators>
        <patterns>Replace Conditional with Polymorphism ; Strategy Pattern ; Template Method Pattern</patterns>
      </principle>

      <principle id="LSP" name="Liskov Substitution Principle">
        <description>Subtypes must be substitutable for their base types.</description>
        <indicators>Subclasses that throw "NotImplemented" exceptions ; Type checks before calling methods ; Subclasses that violate parent class contracts</indicators>
        <patterns>Extract Superclass (properly) ; Replace Inheritance with Composition ; Push Down Method</patterns>
      </principle>

      <principle id="ISP" name="Interface Segregation Principle">
        <description>Clients should depend only on the interfaces they use.</description>
        <indicators>Fat interfaces with many methods ; Classes implementing interfaces with empty/stub methods ; Interface changes affecting unrelated clients</indicators>
        <patterns>Extract Interface ; Split interface by client need</patterns>
      </principle>

      <principle id="DIP" name="Dependency Inversion Principle">
        <description>Depend on abstractions, not concretions.</description>
        <indicators>Dependencies created directly inside the code that uses them ; Hard-coded database/API calls in business logic ; Tight coupling between layers</indicators>
        <patterns>Dependency Injection ; Extract Interface for dependencies ; Repository/Gateway patterns</patterns>
      </principle>

    </principle_group>

    <principle id="SoC" name="Separation of Concerns">
      <description>Divide code into distinct sections, each addressing a separate concern.</description>
      <indicators>UI logic mixed with business logic ; Data access code in controllers ; Validation scattered across layers ; Cross-cutting concerns duplicated everywhere</indicators>
      <refactoring>Extract layers (presentation, business, data) ; Create dedicated service classes ; Centralize cross-cutting concerns ; Apply appropriate architectural patterns</refactoring>
    </principle>

  </principles>

  <code_smells>

    <category id="bloaters" name="Bloaters">
      <description>Code that has grown too large to be easily managed</description>
      <smell id="long_method">
        <name>Long Method</name>
        <detection>More than 30 lines ; Multiple levels of abstraction ; Hard to name - doing too many things ; Requires scrolling to read ; More than 2-3 levels of nesting</detection>
        <refactorings>Extract Method (primary) ; Replace Temp with Query ; Introduce Parameter Object ; Decompose Conditional</refactorings>
      </smell>

      <smell id="large_class">
        <name>Large Class / God Class</name>
        <detection>More than 200-300 lines ; Too many instance variables (>7) ; Multiple distinct responsibilities ; Low cohesion - methods don't use same fields ; Name includes Manager, Handler, Processor, Controller with many methods</detection>
        <refactorings>Extract Class (primary) ; Extract Subclass ; Extract Interface</refactorings>
      </smell>

      <smell id="long_parameter_list">
        <name>Long Parameter List</name>
        <detection>More than 3-4 parameters ; Boolean flags as parameters ; Parameters that always travel together ; Null parameters passed frequently</detection>
        <refactorings>Introduce Parameter Object (primary) ; Replace Parameter with Method Call ; Preserve Whole Object</refactorings>
      </smell>

      <smell id="primitive_obsession">
        <name>Primitive Obsession</name>
        <detection>Using primitives for domain concepts (string for email, int for money) ; Constants for type codes ; String parsing throughout code ; Validation logic repeated for same data</detection>
        <refactorings>Replace Primitive with Object (primary) ; Replace Type Code with Class ; Replace Type Code with Subclasses</refactorings>
      </smell>

      <smell id="data_clumps">
        <name>Data Clumps</name>
        <detection>Same group of variables passed together repeatedly ; Same fields in multiple classes ; Related parameters always appearing together</detection>
        <refactorings>Extract Class (primary) ; Introduce Parameter Object ; Preserve Whole Object</refactorings>
      </smell>
    </category>

    <category id="oo_abusers" name="Object-Orientation Abusers">
      <description>Incorrect application of OO principles</description>

      <smell id="switch_statements">
        <name>Switch Statements / Long If-Else</name>
        <detection>Switch on type code ; Same switch repeated in multiple places ; Runtime type checks before choosing a behaviour ; If-else chain with >3 branches</detection>
        <refactorings>Replace Conditional with Polymorphism (primary) ; Replace Type Code with Subclasses ; Replace Type Code with Strategy</refactorings>
      </smell>

      <smell id="refused_bequest">
        <name>Refused Bequest</name>
        <detection>Subclass only uses few inherited methods ; Overriding methods to do nothing ; Throwing NotImplemented exceptions</detection>
        <refactorings>Replace Inheritance with Delegation (primary) ; Extract Subclass ; Push Down Method</refactorings>
      </smell>

      <smell id="temporary_field">
        <name>Temporary Field</name>
        <detection>Instance variables only used sometimes ; Fields that are null most of the time ; Complex conditional logic around field validity</detection>
        <refactorings>Extract Class (primary) ; Introduce Null Object ; Replace Method with Method Object</refactorings>
      </smell>
    </category>

    <category id="change_preventers" name="Change Preventers">
      <description>Structures that make changes difficult</description>

      <smell id="divergent_change">
        <name>Divergent Change</name>
        <detection>One class changed for multiple different reasons ; Changes to unrelated features affect same class ; "When I change X, I also change methods A, B; when I change Y, I change C, D"</detection>
        <refactorings>Extract Class (primary) ; Extract Superclass</refactorings>
      </smell>

      <smell id="shotgun_surgery">
        <name>Shotgun Surgery</name>
        <detection>Small change requires modifications in many classes ; Related code scattered across the codebase ; Adding a feature touches 5+ files</detection>
        <refactorings>Move Method (primary) ; Move Field ; Inline Class (to consolidate)</refactorings>
      </smell>

      <smell id="parallel_inheritance">
        <name>Parallel Inheritance Hierarchies</name>
        <detection>Creating subclass in one hierarchy requires subclass in another ; Prefixes of class names match across hierarchies</detection>
        <refactorings>Move Method/Field to eliminate one hierarchy (primary)</refactorings>
      </smell>
    </category>

    <category id="dispensables" name="Dispensables">
      <description>Code that serves no purpose</description>

      <smell id="dead_code">
        <name>Dead Code</name>
        <detection>Unreachable code paths ; Unused variables, parameters, methods ; Commented-out code ; Unused imports ; Conditions that are always true/false</detection>
        <refactorings>Remove Dead Code (primary)</refactorings>
      </smell>

      <smell id="speculative_generality">
        <name>Speculative Generality</name>
        <detection>Abstract classes with single implementation ; Unused hooks or extension points ; "Future-proofing" without current need ; Overly generic names (doProcess, handleData)</detection>
        <refactorings>Collapse Hierarchy (primary) ; Inline Class ; Remove Parameter</refactorings>
      </smell>

      <smell id="lazy_class">
        <name>Lazy Class</name>
        <detection>Class that doesn't do enough to justify existence ; Classes created for "future use" ; Wrapper classes that just delegate</detection>
        <refactorings>Inline Class (primary) ; Collapse Hierarchy</refactorings>
      </smell>

      <smell id="duplicate_code">
        <name>Duplicate Code</name>
        <detection>Identical or very similar code in multiple places ; Same algorithm implemented differently ; Copy-paste with minor modifications</detection>
        <refactorings>Extract Method (primary) ; Extract Class ; Pull Up Method ; Form Template Method</refactorings>
      </smell>

      <smell id="comments">
        <name>Excessive Comments</name>
        <detection>Comments explaining what code does (not why) ; Commented-out code ; Comments that don't match the code ; TODOs that will never be done</detection>
        <refactorings>Extract Method (with good name) (primary) ; Rename (to self-documenting names) ; Remove Dead Code</refactorings>
      </smell>
    </category>

    <category id="couplers" name="Couplers">
      <description>Excessive coupling between classes</description>

      <smell id="feature_envy">
        <name>Feature Envy</name>
        <detection>Method uses more features of another class than its own ; Excessive getter calls on another object ; Method would be simpler if moved to another class</detection>
        <refactorings>Move Method (primary) ; Extract Method + Move</refactorings>
      </smell>

      <smell id="inappropriate_intimacy">
        <name>Inappropriate Intimacy</name>
        <detection>Classes that know too much about each other's internals ; Bidirectional dependencies ; Accessing private/internal members</detection>
        <refactorings>Move Method/Field (primary) ; Extract Class (to mediate) ; Replace Inheritance with Delegation</refactorings>
      </smell>

      <smell id="message_chains">
        <name>Message Chains</name>
        <detection>Long chains: a.getB().getC().getD().doSomething() ; Law of Demeter violations ; Chained optional/null checks</detection>
        <refactorings>Hide Delegate (primary) ; Extract Method ; Move Method</refactorings>
      </smell>

      <smell id="middle_man">
        <name>Middle Man</name>
        <detection>Class that only delegates to another class ; Most methods just forward calls ; No value added by the intermediary</detection>
        <refactorings>Remove Middle Man (primary) ; Inline Method</refactorings>
      </smell>
    </category>

  </code_smells>

  <refactoring_patterns>
    <rule>Refactor in small steps that keep the behaviour unchanged; after each step, run the project checks and tests (« Commandes du projet » of docs/technical.md).</rule>

    <category id="composing_methods" name="Composing Methods">
      <pattern id="extract_method">
        <name>Extract Method</name>
        <intent>Turn a code fragment into a method whose name explains its purpose; local variables become parameters or return values</intent>
      </pattern>
      <pattern id="inline_method">
        <name>Inline Method</name>
        <intent>Replace a method call with the method's body</intent>
        <when>Method body is as clear as the name, or excessive indirection; only for a method without overrides</when>
      </pattern>
      <pattern id="extract_variable">
        <name>Extract Variable / Introduce Explaining Variable</name>
        <intent>Put a complex expression into a well-named variable (immutable if the language allows it): isMacOS = contains(upper(platform), "MAC")</intent>
      </pattern>
      <pattern id="replace_temp_with_query">
        <name>Replace Temp with Query</name>
        <intent>Replace temporary variable with a method call</intent>
        <when>Temporary is used multiple times, or extracting improves clarity</when>
      </pattern>
    </category>

    <category id="moving_features" name="Moving Features">
      <pattern id="move_method">
        <name>Move Method</name>
        <intent>Move a method to the class that uses it most; the source delegates or disappears</intent>
      </pattern>
      <pattern id="move_field">
        <name>Move Field</name>
        <intent>Move a field to the class that uses it most</intent>
      </pattern>
      <pattern id="extract_class">
        <name>Extract Class</name>
        <intent>Create a new class and move relevant fields and methods, one at a time, keeping its exposed surface minimal</intent>
        <when>A class is doing work that should be done by two</when>
      </pattern>
      <pattern id="inline_class">
        <name>Inline Class</name>
        <intent>Move all features into another class and delete the empty class</intent>
        <when>A class isn't doing enough to justify its existence</when>
      </pattern>
      <pattern id="hide_delegate">
        <name>Hide Delegate</name>
        <intent>Create a method on the server to hide the delegate: person.getManager() instead of person.department.manager</intent>
        <when>Client calls a method on an object returned by another method</when>
      </pattern>
    </category>

    <category id="organizing_data" name="Organizing Data">
      <pattern id="replace_primitive_with_object">
        <name>Replace Primitive with Object</name>
        <intent>Replace a primitive with a small value object, valid by construction: TelephoneNumber.create(number) validates once and refuses an invalid number, instead of plain text validated (or not) everywhere it is used</intent>
      </pattern>
      <pattern id="replace_magic_number">
        <name>Replace Magic Number with Symbolic Constant</name>
        <intent>Replace literal number with a well-named constant (qualite/clean-code.md §3)</intent>
      </pattern>
      <pattern id="encapsulate_field">
        <name>Encapsulate Field</name>
        <intent>Make a public field private and provide accessors</intent>
      </pattern>
      <pattern id="replace_type_code_with_class">
        <name>Replace Type Code with Class/Enum</name>
        <intent>Replace numeric type code with a class or enumeration</intent>
      </pattern>
    </category>

    <category id="simplifying_conditionals" name="Simplifying Conditionals">
      <pattern id="decompose_conditional">
        <name>Decompose Conditional</name>
        <intent>Extract methods from condition, then-part, and else-part: if isWinter(date) charge = winterCharge(quantity)</intent>
      </pattern>
      <pattern id="consolidate_conditional">
        <name>Consolidate Conditional Expression</name>
        <intent>Combine multiple conditionals that lead to same result into one condition, then extract it into a named function</intent>
      </pattern>
      <pattern id="replace_nested_with_guard">
        <name>Replace Nested Conditional with Guard Clauses</name>
        <intent>Use guard clauses (early returns) for special cases, leaving the normal case last and unindented</intent>
      </pattern>
      <pattern id="replace_conditional_with_polymorphism">
        <name>Replace Conditional with Polymorphism</name>
        <intent>Move each leg of the conditional to an overriding method</intent>
        <when>Conditional switches on type code or object type</when>
      </pattern>
      <pattern id="introduce_null_object">
        <name>Introduce Null Object / Special Case</name>
        <intent>Replace null checks with a null object providing default behavior</intent>
      </pattern>
    </category>

    <category id="simplifying_calls" name="Simplifying Method Calls">
      <pattern id="rename_method">
        <name>Rename Method</name>
        <intent>Change the name to better reveal its purpose</intent>
        <guidance>Name should describe WHAT it does, leaving HOW to the body</guidance>
      </pattern>
      <pattern id="introduce_parameter_object">
        <name>Introduce Parameter Object</name>
        <intent>Replace related parameters with one named structure (record, object, type): amountInvoiced(range) with DateRange = { start, end }, instead of amountInvoiced(startDate, endDate)</intent>
        <when>Same group of parameters appears together repeatedly</when>
      </pattern>
      <pattern id="preserve_whole_object">
        <name>Preserve Whole Object</name>
        <intent>Pass the whole object instead of extracting values</intent>
      </pattern>
      <pattern id="replace_parameter_with_method">
        <name>Replace Parameter with Method Call</name>
        <intent>Remove parameter when receiver can call method directly</intent>
      </pattern>
      <pattern id="separate_query_from_modifier">
        <name>Separate Query from Modifier</name>
        <intent>Split method into query (returns value) and modifier (changes state)</intent>
        <rule>A method should do exactly one of the two: return a value, or have side effects</rule>
      </pattern>
    </category>

  </refactoring_patterns>

  <!-- Références du plugin, à lire avec : pulse-aidd reference <chemin> -->
  <attached_references>
    <reference>qualite/clean-code.md</reference>
    <reference>qualite/composants.md</reference>
    <reference>qualite/securite-code.md</reference>
  </attached_references>

</refactoring_library>
