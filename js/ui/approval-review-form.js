(function (root) {
  'use strict';

  function buildDecisionFieldset() {
    var fieldset = document.createElement('fieldset');
    fieldset.className = 'decision-group field-wide';
    var legend = document.createElement('legend');
    legend.textContent = 'Decision';
    fieldset.appendChild(legend);

    var approveLabel = document.createElement('label');
    approveLabel.className = 'decision-option';
    var approveRadio = document.createElement('input');
    approveRadio.type = 'radio';
    approveRadio.name = 'decision';
    approveRadio.value = 'approve';
    approveRadio.checked = true;
    approveLabel.appendChild(approveRadio);
    approveLabel.appendChild(document.createTextNode('Approve & assign'));

    var rejectLabel = document.createElement('label');
    rejectLabel.className = 'decision-option';
    var rejectRadio = document.createElement('input');
    rejectRadio.type = 'radio';
    rejectRadio.name = 'decision';
    rejectRadio.value = 'reject';
    rejectLabel.appendChild(rejectRadio);
    rejectLabel.appendChild(document.createTextNode('Reject'));

    fieldset.appendChild(approveLabel);
    fieldset.appendChild(rejectLabel);

    return {
      fieldset: fieldset,
      approveRadio: approveRadio,
      rejectRadio: rejectRadio
    };
  }

  function buildVehicleField(recordId, activeDevices, vehicleConflicts) {
    var field = document.createElement('div');
    field.className = 'field';
    var label = document.createElement('label');
    var selectId = 'approval-vehicle-' + recordId;
    label.htmlFor = selectId;
    label.textContent = 'Assign vehicle (Active) *';

    var select = document.createElement('select');
    select.id = selectId;
    select.name = 'deviceId';
    select.required = true;

    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = activeDevices.length
      ? 'Select an active vehicle'
      : 'No active vehicles available';
    select.appendChild(placeholder);

    var availableCount = 0;
    activeDevices.forEach(function (device) {
      var option = document.createElement('option');
      var conflict = vehicleConflicts[device.id];
      if (!conflict) availableCount += 1;
      option.value = device.id;
      option.textContent = (device.name || device.id) +
        (conflict ? ' (Unavailable: booked in this slot)' : '');
      option.disabled = Boolean(conflict);
      select.appendChild(option);
    });

    var hint = document.createElement('p');
    hint.className = availableCount === 0 ? 'field-hint field-hint-warn' : 'field-hint';
    hint.textContent = activeDevices.length === 0
      ? 'No active vehicles found in this account.'
      : availableCount + ' of ' + activeDevices.length + ' active ' +
        (activeDevices.length === 1 ? 'vehicle' : 'vehicles') + ' available for this slot.';

    field.appendChild(label);
    field.appendChild(select);
    field.appendChild(hint);
    return { field: field, select: select };
  }

  function buildDriverField(recordId, activeDrivers, driverConflicts, usersLoadState, userDomain) {
    var field = document.createElement('div');
    field.className = 'field';
    var label = document.createElement('label');
    var selectId = 'approval-driver-' + recordId;
    label.htmlFor = selectId;
    label.textContent = 'Assign driver (Active Driver) *';

    var select = document.createElement('select');
    select.id = selectId;
    select.name = 'driverId';
    select.required = true;

    var placeholder = document.createElement('option');
    placeholder.value = '';
    if (usersLoadState === 'loading') {
      placeholder.textContent = 'Loading active drivers...';
    } else if (usersLoadState === 'error') {
      placeholder.textContent = 'Unable to load drivers (check User permission)';
    } else {
      placeholder.textContent = activeDrivers.length
        ? 'Select an active driver'
        : 'No active drivers available';
    }
    select.appendChild(placeholder);

    var availableCount = 0;
    activeDrivers.forEach(function (driver) {
      var option = document.createElement('option');
      var conflict = driverConflicts[driver.id];
      if (!conflict) availableCount += 1;
      option.value = driver.id;
      option.textContent = userDomain.getUserFullName(driver) +
        (driver.login ? ' (' + driver.login + ')' : '') +
        (conflict ? ' - Unavailable (assigned in this slot)' : '');
      option.disabled = Boolean(conflict);
      select.appendChild(option);
    });

    var hint = document.createElement('p');
    if (usersLoadState === 'loading') {
      hint.className = 'field-hint';
      hint.textContent = 'Loading driver directory...';
    } else if (usersLoadState === 'error') {
      hint.className = 'field-hint field-hint-warn';
      hint.textContent = 'Unable to load drivers. Verify User read access.';
    } else {
      hint.className = availableCount === 0 ? 'field-hint field-hint-warn' : 'field-hint';
      hint.textContent = activeDrivers.length === 0
        ? 'No active driver accounts found.'
        : availableCount + ' of ' + activeDrivers.length + ' active ' +
          (activeDrivers.length === 1 ? 'driver' : 'drivers') + ' available for this slot.';
    }

    field.appendChild(label);
    field.appendChild(select);
    field.appendChild(hint);
    return { field: field, select: select };
  }

  function build(options) {
    var record = options.record;
    var conflicts = options.conflicts;
    var activeDevices = options.activeDevices;
    var activeDrivers = options.activeDrivers;
    var usersLoadState = options.usersLoadState;
    var userDomain = options.userDomain;
    var isSubmitting = options.isSubmitting;

    var panel = document.createElement('div');
    panel.className = 'approval-review-panel';

    var form = document.createElement('form');
    form.className = 'approval-review-form';
    form.setAttribute('data-review-form', record.id);

    var decision = buildDecisionFieldset();
    var vehicle = buildVehicleField(record.id, activeDevices, conflicts.vehicles);
    var driver = buildDriverField(record.id, activeDrivers, conflicts.drivers, usersLoadState, userDomain);

    var notesField = document.createElement('div');
    notesField.className = 'field field-wide';
    var notesLabel = document.createElement('label');
    var notesId = 'approval-notes-' + record.id;
    notesLabel.htmlFor = notesId;
    notesLabel.textContent = 'Notes (optional)';
    var notesInput = document.createElement('textarea');
    notesInput.id = notesId;
    notesInput.name = 'approvalNotes';
    notesInput.maxLength = 300;
    notesInput.placeholder = 'Optional dispatch notes (pickup instructions, key location)';
    notesField.appendChild(notesLabel);
    notesField.appendChild(notesInput);

    var inlineError = document.createElement('p');
    inlineError.className = 'approval-inline-error';
    inlineError.setAttribute('role', 'alert');
    inlineError.hidden = true;

    var actions = document.createElement('div');
    actions.className = 'form-actions field-wide';
    var submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'fm-btn-approve';
    submitBtn.textContent = 'Confirm approval';
    submitBtn.setAttribute('data-review-submit', 'true');
    submitBtn.disabled = Boolean(isSubmitting);

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'secondary';
    closeBtn.textContent = 'Cancel';
    closeBtn.setAttribute('data-close-review', 'true');

    actions.appendChild(submitBtn);
    actions.appendChild(closeBtn);

    form.appendChild(decision.fieldset);
    form.appendChild(vehicle.field);
    form.appendChild(driver.field);
    form.appendChild(notesField);
    form.appendChild(inlineError);
    form.appendChild(actions);

    function syncDecisionMode() {
      var isReject = decision.rejectRadio.checked;
      vehicle.field.hidden = isReject;
      driver.field.hidden = isReject;
      vehicle.select.required = !isReject;
      driver.select.required = !isReject;
      notesInput.required = isReject;
      notesLabel.textContent = isReject ? 'Rejection reason *' : 'Notes (optional)';
      notesInput.placeholder = isReject
        ? 'Explain why this booking request is rejected'
        : 'Optional dispatch notes (pickup instructions, key location)';
      submitBtn.className = isReject ? 'fm-btn-reject' : 'fm-btn-approve';
      submitBtn.textContent = isReject ? 'Confirm rejection' : 'Confirm approval';
      inlineError.hidden = true;
    }

    decision.approveRadio.addEventListener('change', syncDecisionMode);
    decision.rejectRadio.addEventListener('change', syncDecisionMode);

    panel.appendChild(form);
    return panel;
  }

  root.FleetAddIn = root.FleetAddIn || {};
  root.FleetAddIn.ApprovalReviewForm = {
    build: build
  };
}(typeof globalThis !== 'undefined' ? globalThis : this));
