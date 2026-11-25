(function (root) {
  'use strict';

  function createApprovalView(deps) {
    var domain = deps.bookingDomain;
    var userDomain = deps.userDomain;
    var apiService = deps.apiService;
    var fmt = deps.formatters;
    var reviewFormBuilder = deps.reviewFormBuilder;
    var state = deps.state;
    var onDataChanged = deps.onDataChanged;
    var onRefreshDrivers = deps.onRefreshDrivers;

    var workspace = document.getElementById('approvalWorkspace');
    var restrictedNotice = document.getElementById('approvalRestrictedNotice');
    var statusBanner = document.getElementById('approvalStatusBanner');
    var statusFilter = document.getElementById('approvalStatusFilter');
    var refreshButton = document.getElementById('refreshApprovalButton');
    var approvalList = document.getElementById('approvalList');

    var reviewingRecordId = null;
    var isSubmitting = false;

    function setBanner(message, isError) {
      statusBanner.textContent = message;
      statusBanner.setAttribute('data-error', isError ? 'true' : 'false');
    }

    function getActiveDevices() {
      return state.devices.filter(fmt.isDeviceActive).sort(function (first, second) {
        return String(first.name || first.id).localeCompare(String(second.name || second.id));
      });
    }

    function resolveRequester(login) {
      var email = String(login || '').trim();
      if (!email) return { name: 'Unknown', subtext: '' };
      var matched = state.users.find(function (user) {
        return user && String(user.login || '').toLowerCase() === email.toLowerCase();
      });
      if (!matched) return { name: email, subtext: '' };
      var fullName = userDomain.getUserFullName(matched);
      return fullName.toLowerCase() === email.toLowerCase()
        ? { name: email, subtext: '' }
        : { name: fullName, subtext: email };
    }

    function createSummaryItem(labelText, valueText, subText) {
      var item = document.createElement('div');
      item.className = 'trip-summary-item';

      var label = document.createElement('span');
      label.className = 'trip-summary-label';
      label.textContent = labelText;
      item.appendChild(label);

      var value = document.createElement('span');
      value.className = 'trip-summary-value';
      value.textContent = valueText;
      item.appendChild(value);

      if (subText) {
        var sub = document.createElement('span');
        sub.className = 'trip-summary-sub';
        sub.textContent = subText;
        item.appendChild(sub);
      }
      return item;
    }

    function buildTripSummaryGrid(details) {
      var grid = document.createElement('div');
      grid.className = 'trip-summary-grid';

      var requester = resolveRequester(details.createdBy);
      var schedule = fmt.getScheduleSummary(details.startUtc, details.endUtc);
      var timeSub = schedule.durationText ? 'Duration: ' + schedule.durationText : '';

      grid.appendChild(createSummaryItem('Requester', requester.name, requester.subtext));
      grid.appendChild(createSummaryItem('Date', schedule.dateText));
      grid.appendChild(createSummaryItem('Time & duration', schedule.timeText, timeSub));
      grid.appendChild(createSummaryItem('Submitted', fmt.formatSubmittedAt(details.createdAtUtc)));
      return grid;
    }

    function buildCard(record) {
      var details = record.details || {};
      var status = domain.normalizeStatus(details.status);
      var card = document.createElement('article');
      card.className = 'approval-card';

      var top = document.createElement('div');
      top.className = 'approval-card-top';

      var info = document.createElement('div');
      info.className = 'booking-details';

      var headerRow = document.createElement('div');
      headerRow.className = 'booking-header-row';
      var title = document.createElement('p');
      title.className = 'booking-title';
      title.textContent = details.destination || details.purpose || 'Booking request';
      headerRow.appendChild(title);
      headerRow.appendChild(fmt.createStatusBadge(status));
      info.appendChild(headerRow);

      var purposeLine = document.createElement('p');
      purposeLine.className = 'booking-purpose';
      purposeLine.textContent = 'Purpose: ' + (details.purpose || 'Not specified');
      info.appendChild(purposeLine);

      top.appendChild(info);

      if (status === 'pending') {
        var actions = document.createElement('div');
        actions.className = 'booking-actions';
        var reviewBtn = document.createElement('button');
        reviewBtn.type = 'button';
        var isOpen = String(reviewingRecordId) === String(record.id);
        reviewBtn.className = isOpen ? 'secondary' : '';
        reviewBtn.textContent = isOpen ? 'Close review' : 'Review';
        reviewBtn.setAttribute('data-toggle-review', record.id);
        reviewBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        actions.appendChild(reviewBtn);
        top.appendChild(actions);
      }

      card.appendChild(top);
      card.appendChild(buildTripSummaryGrid(details));

      if (status === 'approved' || status === 'confirmed') {
        var assignmentMeta = document.createElement('p');
        assignmentMeta.className = 'booking-meta';
        assignmentMeta.textContent = 'Assigned vehicle: ' + fmt.resolveDeviceName(details, state.devices) +
          ' | Driver: ' + (details.driverName || details.driverLogin || 'Unassigned') +
          (details.reviewedBy ? ' | Approved by: ' + details.reviewedBy : '');
        card.appendChild(assignmentMeta);
      } else if (status === 'rejected' && details.reviewedBy) {
        var rejectedMeta = document.createElement('p');
        rejectedMeta.className = 'booking-meta';
        rejectedMeta.textContent = 'Rejected by: ' + details.reviewedBy +
          (details.reviewedAtUtc ? ' on ' + fmt.formatDate(details.reviewedAtUtc) : '');
        card.appendChild(rejectedMeta);
      }

      if (details.approvalNotes) {
        var notes = document.createElement('p');
        notes.className = status === 'rejected'
          ? 'notes-callout notes-callout-rejected'
          : 'notes-callout';
        notes.textContent = (status === 'rejected' ? 'Rejection reason: ' : 'Notes: ') + details.approvalNotes;
        card.appendChild(notes);
      }

      if (status === 'pending' && String(reviewingRecordId) === String(record.id)) {
        var conflicts = domain.getConflictingResources(
          state.bookings,
          details.startUtc,
          details.endUtc,
          record.id
        );
        card.appendChild(reviewFormBuilder.build({
          record: record,
          conflicts: conflicts,
          activeDevices: getActiveDevices(),
          activeDrivers: userDomain.getActiveDrivers(state.users),
          usersLoadState: state.usersLoadState,
          userDomain: userDomain,
          isSubmitting: isSubmitting
        }));
      }

      return card;
    }

    function render() {
      if (!state.isAdministrator) {
        workspace.hidden = true;
        restrictedNotice.hidden = false;
        return;
      }

      workspace.hidden = false;
      restrictedNotice.hidden = true;

      var filterValue = statusFilter.value || 'pending';
      var items = domain.filterApprovalQueue(state.bookings, filterValue).slice();
      items.sort(function (first, second) {
        var firstStart = Date.parse(first.details && first.details.startUtc);
        var secondStart = Date.parse(second.details && second.details.startUtc);
        return filterValue === 'pending' ? firstStart - secondStart : secondStart - firstStart;
      });

      var pendingTotal = domain.filterApprovalQueue(state.bookings, 'pending').length;
      if (!statusBanner.getAttribute('data-sticky')) {
        setBanner(
          pendingTotal === 0
            ? 'No pending booking requests right now.'
            : pendingTotal + (pendingTotal === 1 ? ' pending booking request' : ' pending booking requests') +
              ' awaiting administrator review.',
          false
        );
      }

      approvalList.textContent = '';
      if (items.length === 0) {
        approvalList.appendChild(fmt.createEmptyBlock(
          filterValue === 'pending'
            ? 'All caught up. There are no pending bookings to review.'
            : 'No bookings match the selected approval status.'
        ));
        return;
      }

      items.forEach(function (record) {
        approvalList.appendChild(buildCard(record));
      });
    }

    async function handleReviewSubmit(form) {
      if (!state.isAdministrator || isSubmitting) return;

      var recordId = form.getAttribute('data-review-form');
      var inlineError = form.querySelector('.approval-inline-error');
      var decisionRadio = form.querySelector('input[name="decision"]:checked');
      var deviceSelect = form.querySelector('select[name="deviceId"]');
      var driverSelect = form.querySelector('select[name="driverId"]');
      var notesInput = form.querySelector('textarea[name="approvalNotes"]');
      var submitBtn = form.querySelector('[data-review-submit]');

      inlineError.hidden = true;
      isSubmitting = true;
      if (submitBtn) submitBtn.disabled = true;

      try {
        var validated = domain.validateApprovalDecision({
          decision: decisionRadio ? decisionRadio.value : '',
          deviceId: deviceSelect ? deviceSelect.value : '',
          driverId: driverSelect ? driverSelect.value : '',
          approvalNotes: notesInput ? notesInput.value : ''
        });

        var freshRecords = await apiService.getBookingRecords(state.api);
        var targetRecord = freshRecords.find(function (item) {
          return String(item.id) === String(recordId);
        });
        if (!targetRecord || domain.normalizeStatus(targetRecord.details.status) !== 'pending') {
          throw new Error('This booking is no longer pending. Refresh the queue to see the latest status.');
        }

        var now = new Date().toISOString();
        var updatedDetails;
        var assignedDevice = null;
        var assignedDriver = null;

        if (validated.decision === 'approve') {
          assignedDevice = getActiveDevices().find(function (item) {
            return String(item.id) === validated.deviceId;
          });
          if (!assignedDevice) {
            throw new Error('Selected vehicle is not active or unavailable.');
          }

          assignedDriver = userDomain.getActiveDrivers(state.users).find(function (item) {
            return String(item.id) === validated.driverId;
          });
          if (!assignedDriver) {
            throw new Error('Selected driver is not an active driver account.');
          }

          if (domain.hasVehicleConflict(
            freshRecords,
            assignedDevice.id,
            targetRecord.details.startUtc,
            targetRecord.details.endUtc,
            targetRecord.id
          )) {
            throw new Error('Selected vehicle already has an approved booking in this time range.');
          }

          if (domain.hasDriverConflict(
            freshRecords,
            assignedDriver.id,
            targetRecord.details.startUtc,
            targetRecord.details.endUtc,
            targetRecord.id
          )) {
            throw new Error('Selected driver is already assigned to another approved booking in this time range.');
          }

          updatedDetails = Object.assign({}, targetRecord.details, {
            status: 'approved',
            deviceId: assignedDevice.id,
            deviceName: assignedDevice.name || assignedDevice.id,
            driverId: assignedDriver.id,
            driverName: userDomain.getUserFullName(assignedDriver),
            driverLogin: assignedDriver.login || '',
            approvalNotes: validated.approvalNotes,
            reviewedBy: state.currentUserName,
            reviewedAtUtc: now,
            updatedAtUtc: now
          });
        } else {
          updatedDetails = Object.assign({}, targetRecord.details, {
            status: 'rejected',
            deviceId: null,
            deviceName: null,
            driverId: null,
            driverName: null,
            driverLogin: null,
            approvalNotes: validated.approvalNotes,
            reviewedBy: state.currentUserName,
            reviewedAtUtc: now,
            updatedAtUtc: now
          });
        }

        await apiService.updateBookingRecord(state.api, targetRecord, updatedDetails);
        reviewingRecordId = null;
        statusBanner.setAttribute('data-sticky', 'true');

        var refreshed = await onDataChanged(true);
        if (!refreshed) {
          setBanner('Decision saved, but the queue could not be refreshed. Reload to verify.', true);
          return;
        }

        if (validated.decision === 'approve') {
          var vehicleConcurrent = domain.hasVehicleConflict(
            refreshed,
            assignedDevice.id,
            updatedDetails.startUtc,
            updatedDetails.endUtc,
            targetRecord.id
          );
          var driverConcurrent = domain.hasDriverConflict(
            refreshed,
            assignedDriver.id,
            updatedDetails.startUtc,
            updatedDetails.endUtc,
            targetRecord.id
          );
          if (vehicleConcurrent || driverConcurrent) {
            setBanner(
              'Booking approved, but a concurrent assignment conflict was detected. Review the schedule immediately.',
              true
            );
            return;
          }
          setBanner(
            'Booking approved and assigned to ' + updatedDetails.deviceName +
              ' with driver ' + updatedDetails.driverName + '.',
            false
          );
        } else {
          setBanner('Booking rejected with notes recorded.', false);
        }
      } catch (error) {
        inlineError.textContent = fmt.errorText(error);
        inlineError.hidden = false;
      } finally {
        isSubmitting = false;
        if (submitBtn) submitBtn.disabled = false;
        statusBanner.removeAttribute('data-sticky');
      }
    }

    function bind() {
      statusFilter.addEventListener('change', function () {
        reviewingRecordId = null;
        render();
      });
      refreshButton.addEventListener('click', function () {
        statusBanner.removeAttribute('data-sticky');
        onDataChanged(true);
        onRefreshDrivers(true);
      });
      approvalList.addEventListener('click', function (event) {
        var toggleBtn = event.target.closest('[data-toggle-review]');
        if (toggleBtn) {
          var id = toggleBtn.getAttribute('data-toggle-review');
          reviewingRecordId = String(reviewingRecordId) === String(id) ? null : id;
          render();
          return;
        }
        if (event.target.closest('[data-close-review]')) {
          reviewingRecordId = null;
          render();
        }
      });
      approvalList.addEventListener('submit', function (event) {
        var form = event.target.closest('[data-review-form]');
        if (!form) return;
        event.preventDefault();
        handleReviewSubmit(form);
      });
      approvalList.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && reviewingRecordId !== null) {
          reviewingRecordId = null;
          render();
        }
      });
    }

    return {
      bind: bind,
      render: render
    };
  }

  root.FleetAddIn = root.FleetAddIn || {};
  root.FleetAddIn.ApprovalView = {
    create: createApprovalView
  };
}(typeof globalThis !== 'undefined' ? globalThis : this));
